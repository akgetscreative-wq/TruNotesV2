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
static llama_model * g_embed_model = nullptr;
static llama_context * g_embed_context = nullptr;
static std::atomic<bool> g_stop_generation(false);
static std::vector<llama_token> g_past_tokens;
static std::mutex g_mutex;

extern "C"
JNIEXPORT jfloatArray JNICALL
Java_com_trunotes_v2_plugins_AIBridge_nativeEmbed(JNIEnv *env, jobject thiz, jstring jtext) {
    const char * text = env->GetStringUTFChars(jtext, 0);
    std::string text_str(text);
    env->ReleaseStringUTFChars(jtext, text);

    std::lock_guard<std::mutex> lock(g_mutex);

    if (!g_embed_model || !g_embed_context) {
        LOGe("Embed model not loaded. Please load bge-small-en first.");
        return nullptr;
    }

    // 1. Tokenize
    std::vector<llama_token> tokens = common_tokenize(g_embed_context, text_str, true, true);
    if (tokens.empty()) return nullptr;

    // 2. Clear KV cache for fresh embedding if needed (usually embeddings don't need context history)
    llama_memory_clear(llama_get_memory(g_embed_context), true);

    // 3. Decode
    llama_batch batch = llama_batch_init(tokens.size(), 0, 1);
    for (size_t i = 0; i < tokens.size(); i++) {
        common_batch_add(batch, tokens[i], (int)i, { 0 }, i == tokens.size() - 1);
    }

    if (llama_decode(g_embed_context, batch) != 0) {
        LOGe("llama_decode failed in nativeEmbed");
        llama_batch_free(batch);
        return nullptr;
    }

    // 4. Retrieve embeddings
    // bge-small-en uses pooling (usually MEAN or CLS). llama.cpp handles this if pooling_type is set.
    float * emb = llama_get_embeddings(g_embed_context);
    if (!emb) {
        // Fallback or specific seq embedding
        emb = llama_get_embeddings_seq(g_embed_context, 0);
    }

    if (!emb) {
        LOGe("Failed to get embeddings from context");
        llama_batch_free(batch);
        return nullptr;
    }

    int n_embd = llama_model_n_embd(g_embed_model);
    jfloatArray result = env->NewFloatArray(n_embd);
    env->SetFloatArrayRegion(result, 0, n_embd, emb);

    llama_batch_free(batch);
    return result;
}

extern "C"
JNIEXPORT jboolean JNICALL
Java_com_trunotes_v2_plugins_AIBridge_nativeLoadModel(JNIEnv *env, jobject, jstring filename, jboolean use_mmap, jint n_threads, jint n_gpu_layers, jint n_ctx_size) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_stop_generation = true; // Signal current to stop if any

    auto path_to_model = env->GetStringUTFChars(filename, 0);
    std::string path_str(path_to_model);
    bool is_embedding_model = (path_str.find("bge-") != std::string::npos || path_str.find("embedding") != std::string::npos);

    // Cleanup previous if exists for the correct slot
    if (is_embedding_model) {
        if (g_embed_context) llama_free(g_embed_context);
        if (g_embed_model) llama_model_free(g_embed_model);
        g_embed_context = nullptr;
        g_embed_model = nullptr;
        LOGi("Loading Embedding model: %s", path_to_model);
    } else {
        if (g_context) llama_free(g_context);
        if (g_model) llama_model_free(g_model);
        g_context = nullptr;
        g_model = nullptr;
        g_past_tokens.clear();
        LOGi("Loading Generative model: %s", path_to_model);
    }

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
    model_params.use_mlock = false; // Don't lock RAM - causes OOM on old devices
    model_params.n_gpu_layers = n_gpu_layers;
    
    LOGi("Loading model with %d threads and %d GPU layers", n_threads, n_gpu_layers);

    llama_model * loaded_model = llama_model_load_from_file(path_to_model, model_params);
    env->ReleaseStringUTFChars(filename, path_to_model);

    if (!loaded_model) {
        LOGe("load_model() failed");
        return JNI_FALSE;
    }

    if (is_embedding_model) g_embed_model = loaded_model;
    else g_model = loaded_model;

    // Initialize context
    llama_context_params ctx_params = llama_context_default_params();
    if (is_embedding_model) {
        ctx_params.n_ctx = 512;
        ctx_params.embeddings = true;
        ctx_params.pooling_type = LLAMA_POOLING_TYPE_MEAN;
    } else {
        ctx_params.n_ctx = (n_ctx_size > 256) ? n_ctx_size : 1280;
    }
    ctx_params.n_threads = n_threads;
    ctx_params.n_threads_batch = n_threads;
    ctx_params.n_batch = 256; // Lower memory pressure for old devices

    // KV cache stays at default (F16) on all paths — fastest for ARM NEON attention
    // GPU layer offloading is handled via model_params.n_gpu_layers above

    llama_context * loaded_ctx = llama_init_from_model(loaded_model, ctx_params);
    if (!loaded_ctx) {
        LOGe("llama_init_from_model() failed");
        llama_model_free(loaded_model);
        if (is_embedding_model) g_embed_model = nullptr;
        else g_model = nullptr;
        return JNI_FALSE;
    }

    if (is_embedding_model) g_embed_context = loaded_ctx;
    else g_context = loaded_ctx;

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
Java_com_trunotes_v2_plugins_AIBridge_nativeGenerate(JNIEnv *env, jobject thiz, jstring prompt, jint nPredict, jfloat temperature, jint topK, jfloat topP, jfloat penalty, jint n_threads) {
    std::lock_guard<std::mutex> lock(g_mutex);
    g_stop_generation = false; // Reset stop flag for new generation

    if (!g_model || !g_context) {
        return env->NewStringUTF("Error: Model not loaded");
    }

    // Apply thread count for this generation (can differ from model load time)
    llama_set_n_threads(g_context, n_threads, n_threads);

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
        // Match n_batch set at context init (256)
        int n_eval_batch_size = 256;
        llama_batch batch = llama_batch_init(n_eval_batch_size, 0, 1);
        
        for (size_t i = n_keep; i < tokens_list.size(); i += (size_t)n_eval_batch_size) {
            int n_eval = (int)std::min((size_t)n_eval_batch_size, tokens_list.size() - i);
            
            common_batch_clear(batch); 
            for (int j = 0; j < n_eval; j++) {
                bool is_last_token = (i + j == tokens_list.size() - 1);
                common_batch_add(batch, tokens_list[i + j], (int)(i + j), { 0 }, is_last_token);
            }

            if (g_stop_generation) {
                LOGi("Generation stopped during prefill");
                llama_batch_free(batch);
                return env->NewStringUTF(""); // Return empty immediately
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
    if (g_embed_context) {
        llama_free(g_embed_context);
        g_embed_context = nullptr;
    }
    if (g_embed_model) {
        llama_model_free(g_embed_model);
        g_embed_model = nullptr;
    }
    g_past_tokens.clear();
    LOGi("All models and contexts successfully unloaded");
}
