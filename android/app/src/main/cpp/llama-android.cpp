#include <android/log.h>
#include <jni.h>
#include <iomanip>
#include <math.h>
#include <string>
#include <unistd.h>
#include "llama.h"

// Define build info variables required by common.h
int LLAMA_BUILD_NUMBER = 0;
const char * LLAMA_COMMIT = "unknown";
const char * LLAMA_COMPILER = "clang";
const char * LLAMA_BUILD_TARGET = "android";

#include "common.h" 

// Write C++ code here.
//
// Do not forget to dynamically load the C++ library into your application.
//
// For instance,
//
// In MainActivity.java:
//    static {
//       System.loadLibrary("llama-android");
//    }
//
// Or, in MainActivity.kt:
//    companion object {
//      init {
//         System.loadLibrary("llama-android")
//      }
//    }

#define TAG "llama-android.cpp"
#define LOGi(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGe(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

jclass la_int_var;
jmethodID la_int_var_value;
jmethodID la_int_var_inc;

std::string cached_token_chars;

bool is_valid_utf8(const char * string) {
    if (!string) {
        return true;
    }

    const unsigned char * bytes = (const unsigned char *)string;
    int num;

    while (*bytes != 0x00) {
        if ((*bytes & 0x80) == 0x00) {
            // U+0000 to U+007F
            num = 1;
        } else if ((*bytes & 0xE0) == 0xC0) {
            // U+0080 to U+07FF
            num = 2;
        } else if ((*bytes & 0xF0) == 0xE0) {
            // U+0800 to U+FFFF
            num = 3;
        } else if ((*bytes & 0xF8) == 0xF0) {
            // U+10000 to U+10FFFF
            num = 4;
        } else {
            return false;
        }

        bytes += 1;
        for (int i = 1; i < num; ++i) {
            if ((*bytes & 0xC0) != 0x80) {
                return false;
            }
            bytes += 1;
        }
    }

    return true;
}

static void log_callback(ggml_log_level level, const char * fmt, void * data) {
    if (level == GGML_LOG_LEVEL_ERROR)     __android_log_print(ANDROID_LOG_ERROR, TAG, fmt, data);
    else if (level == GGML_LOG_LEVEL_INFO) __android_log_print(ANDROID_LOG_INFO, TAG, fmt, data);
    else if (level == GGML_LOG_LEVEL_WARN) __android_log_print(ANDROID_LOG_WARN, TAG, fmt, data);
    else __android_log_print(ANDROID_LOG_DEFAULT, TAG, fmt, data);
}

#include <vector>
#include <sstream>
#include <atomic>
#include <mutex>

// Global state
static llama_model * g_model = nullptr;
static llama_context * g_context = nullptr;
static std::atomic<bool> g_stop_generation(false);
static std::vector<llama_token> g_past_tokens;
static std::mutex g_mutex;

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_trunotes_v2_plugins_AIBridge_nativeLoadModel(JNIEnv *env, jobject, jstring filename, jboolean use_mmap, jint n_threads) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_stop_generation = true; // Signal current to stop if any

    // Cleanup previous if exists
    if (g_context) {
        llama_free(g_context);
        g_context = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
    g_past_tokens.clear();

    // Initialize backend once
    static bool is_backend_initialized = false;
    if (!is_backend_initialized) {
        LOGi("Initializing llama backend...");
        llama_backend_init();
        is_backend_initialized = true;
        LOGi("llama backend initialized");
    }

    llama_model_params model_params = llama_model_default_params();
    model_params.use_mmap = use_mmap;
    model_params.use_mlock = true; // PERFORMANCE FIX: Pin model in RAM to prevent slow generation

    auto path_to_model = env->GetStringUTFChars(filename, 0);
    LOGi("Loading model from %s", path_to_model);
    LOGi("Model params: mmap=%d, mlock=1, threads=%d", use_mmap, n_threads);

    g_model = llama_model_load_from_file(path_to_model, model_params);
    env->ReleaseStringUTFChars(filename, path_to_model);

    if (!g_model) {
        LOGe("load_model() failed");
        return JNI_FALSE;
    }

    // Initialize context
    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = 2048; // OPTIMIZATION: 4096 is too slow for mobile init. 2048 is fast & sufficient.
    ctx_params.n_threads = n_threads;
    ctx_params.n_threads_batch = n_threads;
    ctx_params.n_batch = 512; // Ensure batch size is optimal for prompt ingestion
    
    // PERFORMANCE BOOSTER: KV Quantization
    ctx_params.type_k = GGML_TYPE_Q8_0; // Use 8-bit quantization for Key cache
    ctx_params.type_v = GGML_TYPE_Q8_0; // Use 8-bit quantization for Value cache

    g_context = llama_init_from_model(g_model, ctx_params);
    if (!g_context) {
        LOGe("llama_init_from_model() failed");
        llama_model_free(g_model);
        g_model = nullptr;
        return JNI_FALSE;
    }

    return JNI_TRUE;
}

// Text generation
extern "C"
// Helper to check if a string ends with a complete UTF-8 character
bool is_complete_utf8(const std::string& str) {
    if (str.empty()) return true;
    unsigned char last = (unsigned char)str.back();
    if ((last & 0x80) == 0) return true; // ASCII is always complete

    size_t len = str.length();
    for (int i = 0; i < 4 && i < len; i++) {
        unsigned char c = (unsigned char)str[len - 1 - i];
        if ((c & 0xC0) == 0x80) continue; // Continuation byte
        if ((c & 0xE0) == 0xC0) return (i == 1); // 2-byte char
        if ((c & 0xF0) == 0xE0) return (i == 2); // 3-byte char
        if ((c & 0xF8) == 0xF0) return (i == 3); // 4-byte char
        return true; // Catch-all for other headers (shouldn't happen in valid stream)
    }
    return false;
}

extern "C"
JNIEXPORT jstring JNICALL
Java_com_trunotes_v2_plugins_AIBridge_nativeGenerate(JNIEnv *env, jobject thiz, jstring prompt, jint nPredict, jfloat temperature, jint topK, jfloat topP, jfloat penalty) {
    std::lock_guard<std::mutex> lock(g_mutex);
    
    if (!g_model || !g_context) {
        return env->NewStringUTF("Error: Model not loaded");
    }

    // Get callback method ID
    jclass cls = env->GetObjectClass(thiz);
    jmethodID mid_callback = env->GetMethodID(cls, "onNativeToken", "(Ljava/lang/String;)V");

    const char * text = env->GetStringUTFChars(prompt, 0);
    std::string prompt_str(text);
    env->ReleaseStringUTFChars(prompt, text);

    std::string response = "";
    std::string pending_output = ""; // Buffer for partial UTF-8 sequences

    // 1. Tokenize the new prompt
    std::vector<llama_token> tokens_list = common_tokenize(g_context, prompt_str, true, true);

    if (tokens_list.empty()) {
        return env->NewStringUTF("Error: No tokens generated from prompt");
    }

    // 2. Incremental KV Cache Management & Context Shifting
    // Find common prefix length with previously stored tokens
    size_t n_keep = 0;
    while (n_keep < g_past_tokens.size() && n_keep < tokens_list.size() && g_past_tokens[n_keep] == tokens_list[n_keep]) {
        n_keep++;
    }

    // Context Shifting (PocketPal Optimization)
    // If context is nearly full, remove the oldest non-system tokens
    int n_ctx = llama_n_ctx(g_context);
    int n_past = g_past_tokens.size();
    int n_new = (int)tokens_list.size() - (int)n_keep;

    if (n_past + n_new > n_ctx - 64) { // 64 buffer for safety
        int n_discard = (n_past - n_keep) / 2; // Discard half of the history tokens
        if (n_discard < 128) n_discard = 128; // Minimum discard size
        
        LOGi("KV Cache FULL: Shifting context. Discarding %d tokens after index %zu", n_discard, n_keep);
        
        // Remove from KV cache
        llama_memory_seq_rm(llama_get_memory(g_context), 0, n_keep, n_keep + n_discard);
        // Shift remaining tokens back
        llama_memory_seq_add(llama_get_memory(g_context), 0, n_keep + n_discard, -1, -n_discard);
        
        // Update global token history to match shifted cache
        if (n_keep + n_discard < g_past_tokens.size()) {
            g_past_tokens.erase(g_past_tokens.begin() + n_keep, g_past_tokens.begin() + n_keep + n_discard);
        }
        
        // Re-align n_keep for evaluation
        n_keep = 0;
        while (n_keep < g_past_tokens.size() && n_keep < tokens_list.size() && g_past_tokens[n_keep] == tokens_list[n_keep]) {
            n_keep++;
        }
    }

    // Remove tokens from cache that are no longer part of the current prompt path
    if (n_keep < g_past_tokens.size()) {
        LOGi("KV Cache: Removing %zu tokens from index %zu", g_past_tokens.size() - n_keep, n_keep);
        llama_memory_seq_rm(llama_get_memory(g_context), 0, n_keep, -1);
    }
    
    g_past_tokens.resize(n_keep);

    // 3. Evaluate the prompt in chunks (Prefill)
    // Capping at n_ctx - 128 to leave room for generation
    if (tokens_list.size() > (size_t)(n_ctx - 128)) {
        LOGe("Prompt too long (%zu tokens), capping to %d", tokens_list.size(), n_ctx - 128);
        tokens_list.resize(n_ctx - 128);
    }

    {
        // HYPERSONIC PREFILL: 128 is much better for mobile RAM pressure than 512.
        // This prevents the "2-minute freeze" on first response.
        int n_eval_batch_size = 128;
        llama_batch batch = llama_batch_init(n_eval_batch_size, 0, 1);
        
        for (size_t i = n_keep; i < tokens_list.size(); i += (size_t)n_eval_batch_size) {
            int n_eval = (int)std::min((size_t)n_eval_batch_size, tokens_list.size() - i);
            
            common_batch_clear(batch); 
            for (int j = 0; j < n_eval; j++) {
                bool is_last_token = (i + j == tokens_list.size() - 1);
                common_batch_add(batch, tokens_list[i + j], (int)(i + j), { 0 }, is_last_token);
            }

            if (llama_decode(g_context, batch) != 0) {
                LOGe("llama_decode failed during prefill");
                llama_batch_free(batch);
                return env->NewStringUTF("Error: Decode failed during prefill");
            }
        }
        llama_batch_free(batch);
    }

    // 4. Sample and Generate loop
    int n_cur = tokens_list.size();
    int n_len = nPredict; 

    llama_sampler_chain_params sparams = llama_sampler_chain_default_params(); 
    llama_sampler * smpl = llama_sampler_chain_init(sparams);
    
    // Add samplers based on user config
    llama_sampler_chain_add(smpl, llama_sampler_init_top_k(topK));
    llama_sampler_chain_add(smpl, llama_sampler_init_top_p(topP, 1)); // min_keep = 1
    llama_sampler_chain_add(smpl, llama_sampler_init_temp(temperature));
    
    // REPETITION PENALTY FIX (Prevents "Euphoria"/Looping/Garbage)
    // We must use the correct signature for llama_sampler_init_penalties
    // int32_t n_vocab = llama_n_vocab(g_model);
    // llama_token eos_token = llama_token_eos(g_model); -- might need model context
    // Safe approach: check if we can get vocab size. 
    // Using penalty_last_n = 64 (standard/good default).
    
    const llama_vocab * vocab_obj = llama_model_get_vocab(g_model);
    int32_t n_vocab_size = llama_vocab_n_tokens(vocab_obj);
    
    // NOTE: If using recent llama.cpp, we need to pass the penalties correctly.
    // REPETITION PENALTY FIX (Prevents "Euphoria"/Looping/Garbage)
    // Using the 4-argument signature found in the user's installed header:
    // int32_t penalty_last_n, float penalty_repeat, float penalty_freq, float penalty_present
    
    llama_sampler_chain_add(smpl, llama_sampler_init_penalties(
        64,                     // penalty_last_n (standard default)
        penalty,                // penalty_repeat (user value, e.g. 1.1)
        0.0f,                   // penalty_freq
        0.0f                    // penalty_present
    ));
    
    // Dist/Greedy
    llama_sampler_chain_add(smpl, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    const llama_vocab * vocab = vocab_obj; // Reuse
    g_stop_generation = false;
    
    // Track what we generate to append to g_past_tokens for next turn
    std::vector<llama_token> generated_tokens;
    llama_batch batch = llama_batch_init(1, 0, 1);

    for (int i = 0; i < n_len; i++) {
        if (g_stop_generation) break;

        llama_token new_token_id = llama_sampler_sample(smpl, g_context, -1);

        if (llama_vocab_is_eog(vocab, new_token_id)) break;

        std::string piece = common_token_to_piece(g_context, new_token_id);
        response += piece;
        generated_tokens.push_back(new_token_id);
        
        // BUFFERING FIX: Accumulate piece and only send if complete UTF-8
        pending_output += piece;

        if (mid_callback && !pending_output.empty() && is_complete_utf8(pending_output)) {
            jstring jpiece = env->NewStringUTF(pending_output.c_str());
            env->CallVoidMethod(thiz, mid_callback, jpiece);
            env->DeleteLocalRef(jpiece);
            pending_output = "";
        }

        common_batch_clear(batch);
        common_batch_add(batch, new_token_id, n_cur, { 0 }, true);
        
        n_cur += 1;

        if (llama_decode(g_context, batch) != 0) break;
    }
    
    // Flush any remaining partial bytes (though likely invalid if incomplete)
    if (mid_callback && !pending_output.empty()) {
         jstring jpiece = env->NewStringUTF(pending_output.c_str());
         env->CallVoidMethod(thiz, mid_callback, jpiece);
         env->DeleteLocalRef(jpiece);
    }

    // Update global past tokens with full path (Prompt + Response)
    g_past_tokens = tokens_list;
    g_past_tokens.insert(g_past_tokens.end(), generated_tokens.begin(), generated_tokens.end());
    llama_sampler_free(smpl);
    llama_batch_free(batch);

    return env->NewStringUTF(response.c_str());
}

extern "C"
JNIEXPORT void JNICALL
Java_com_trunotes_v2_plugins_AIBridge_nativeStopGenerate(JNIEnv *env, jobject) {
    g_stop_generation = true;
}

extern "C"
JNIEXPORT void JNICALL
Java_com_trunotes_v2_plugins_AIBridge_nativeUnloadModel(JNIEnv *env, jobject) {
    LOGi("nativeUnloadModel initiated...");
    g_stop_generation = true; 
    
    // Wait for mutex to ensure generate() has finished its loop
    std::lock_guard<std::mutex> lock(g_mutex);
    
    if (g_context) {
        llama_free(g_context);
        g_context = nullptr;
    }
    if (g_model) {
        llama_model_free(g_model);
        g_model = nullptr;
    }
    g_past_tokens.clear();
    LOGi("Model and context successfully unloaded from memory");
}
