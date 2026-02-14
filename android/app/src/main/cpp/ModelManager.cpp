#include "ModelManager.h"
#include <android/log.h>

#define TAG "ModelManager"
#define LOGi(...) __android_log_print(ANDROID_LOG_INFO, TAG, __VA_ARGS__)
#define LOGe(...) __android_log_print(ANDROID_LOG_ERROR, TAG, __VA_ARGS__)

ModelManager* ModelManager::instance = nullptr;
std::mutex ModelManager::mutex_;

ModelManager::ModelManager() 
    : model(nullptr), context(nullptr), batch(nullptr), sampler(nullptr), initialized(false) {
    llama_backend_init();
}

ModelManager::~ModelManager() {
    unloadModel();
    llama_backend_free();
}

ModelManager* ModelManager::getInstance() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (instance == nullptr) {
        instance = new ModelManager();
    }
    return instance;
}

bool ModelManager::loadModel(const std::string& path, bool use_mmap, int n_threads) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (initialized) {
        LOGi("Model already loaded, unloading first");
        unloadModel();
    }
    
    LOGi("Loading model from: %s", path.c_str());
    
    // Model parameters
    llama_model_params model_params = llama_model_default_params();
    model_params.use_mmap = use_mmap;
    
    // Load model
    model = llama_model_load_from_file(path.c_str(), model_params);
    if (!model) {
        LOGe("Failed to load model");
        return false;
    }
    LOGi("Model loaded successfully");
    
    // Context parameters
    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = 2048;
    ctx_params.n_threads = n_threads;
    ctx_params.n_threads_batch = n_threads;
    
    // Create context
    context = llama_init_from_model(model, ctx_params);
    if (!context) {
        LOGe("Failed to create context");
        llama_model_free(model);
        model = nullptr;
        return false;
    }
    LOGi("Context created successfully");
    
    // Create batch
    batch = new llama_batch{
        0,       // n_tokens
        nullptr, // token
        nullptr, // embd
        nullptr, // pos
        nullptr, // n_seq_id
        nullptr, // seq_id
        nullptr  // logits
    };
    
    int n_tokens = 512;
    batch->token = (llama_token*) malloc(sizeof(llama_token) * n_tokens);
    batch->pos = (llama_pos*) malloc(sizeof(llama_pos) * n_tokens);
    batch->n_seq_id = (int32_t*) malloc(sizeof(int32_t) * n_tokens);
    batch->seq_id = (llama_seq_id**) malloc(sizeof(llama_seq_id*) * n_tokens);
    for (int i = 0; i < n_tokens; ++i) {
        batch->seq_id[i] = (llama_seq_id*) malloc(sizeof(llama_seq_id));
    }
    batch->logits = (int8_t*) malloc(sizeof(int8_t) * n_tokens);
    
    // Create sampler
    auto sparams = llama_sampler_chain_default_params();
    sampler = llama_sampler_chain_init(sparams);
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.8f));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    
    initialized = true;
    LOGi("Model initialization complete");
    return true;
}

void ModelManager::unloadModel() {
    if (sampler) {
        llama_sampler_free(sampler);
        sampler = nullptr;
    }
    
    if (batch) {
        if (batch->token) free(batch->token);
        if (batch->pos) free(batch->pos);
        if (batch->n_seq_id) free(batch->n_seq_id);
        if (batch->seq_id) {
            for (int i = 0; i < 512; ++i) {
                if (batch->seq_id[i]) free(batch->seq_id[i]);
            }
            free(batch->seq_id);
        }
        if (batch->logits) free(batch->logits);
        delete batch;
        batch = nullptr;
    }
    
    if (context) {
        llama_free(context);
        context = nullptr;
    }
    
    if (model) {
        llama_model_free(model);
        model = nullptr;
    }
    
    initialized = false;
    LOGi("Model unloaded");
}

std::string ModelManager::generate(const std::string& prompt, int max_tokens) {
    if (!initialized || !model || !context) {
        LOGe("Model not loaded");
        return "";
    }
    
    LOGi("Generating response for prompt: %s", prompt.c_str());
    
    // Tokenize prompt
    auto tokens = common_tokenize(context, prompt, true, false);
    LOGi("Prompt tokenized to %zu tokens", tokens.size());
    
    // Clear batch
    batch->n_tokens = 0;
    
    // Add prompt tokens to batch
    for (size_t i = 0; i < tokens.size(); ++i) {
        common_batch_add(*batch, tokens[i], i, {0}, false);
    }
    
    // Set last token to output logits
    if (batch->n_tokens > 0) {
        batch->logits[batch->n_tokens - 1] = true;
    }
    
    // Decode prompt
    if (llama_decode(context, *batch) != 0) {
        LOGe("Failed to decode prompt");
        return "";
    }
    
    std::string response;
    int n_cur = tokens.size();
    int n_len = n_cur + max_tokens;
    
    // Generate tokens
    while (n_cur < n_len) {
        // Sample next token
        auto new_token_id = llama_sampler_sample(sampler, context, -1);
        
        // Check for end of generation
        auto vocab = llama_model_get_vocab(model);
        if (llama_vocab_is_eog(vocab, new_token_id)) {
            LOGi("End of generation token encountered");
            break;
        }
        
        // Convert token to text
        auto token_str = common_token_to_piece(context, new_token_id);
        response += token_str;
        
        // Prepare for next iteration
        batch->n_tokens = 0;
        common_batch_add(*batch, new_token_id, n_cur, {0}, true);
        
        n_cur++;
        
        // Decode
        if (llama_decode(context, *batch) != 0) {
            LOGe("Failed to decode token");
            break;
        }
    }
    
    LOGi("Generated %zu characters", response.size());
    return response;
}
