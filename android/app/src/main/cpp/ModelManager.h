#ifndef MODELMANAGER_H
#define MODELMANAGER_H

#include "llama.h"
#include "common.h"
#include <string>
#include <mutex>

class ModelManager {
private:
    static ModelManager* instance;
    static std::mutex mutex_;

    llama_model* model;
    llama_context* context;
    llama_batch* batch;
    llama_sampler* sampler;
    
    bool initialized;
    
    ModelManager();
    ~ModelManager();

public:
    // Singleton access
    static ModelManager* getInstance();
    
    // Delete copy/move constructors
    ModelManager(const ModelManager&) = delete;
    ModelManager& operator=(const ModelManager&) = delete;
    
    // Model management
    bool loadModel(const std::string& path, bool use_mmap = true, int n_threads = 4);
    void unloadModel();
    bool isModelLoaded() const { return initialized && model != nullptr; }
    
    // Generation
    std::string generate(const std::string& prompt, int max_tokens = 128);
    
    // Getters
    llama_model* getModel() { return model; }
    llama_context* getContext() { return context; }
    llama_batch* getBatch() { return batch; }
    llama_sampler* getSampler() { return sampler; }
};

#endif // MODELMANAGER_H
