import pickle, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
os.chdir(os.path.join(os.path.dirname(__file__), '..'))

model_path = "./storage/ml_models/current_model.pkl"
os.makedirs(os.path.dirname(model_path), exist_ok=True)

# Create a fresh model with original hand-crafted weights
from app.ml.scoring import ModelPersistence
m = ModelPersistence()
m.weights = {
    "趋势评分": 0.22, "资金评分": 0.18, "题材评分": 0.15,
    "板块评分": 0.08, "技术评分": 0.10, "情绪评分": 0.12,
    "龙虎榜评分": 0.05, "历史相似度评分": 0.03, "新闻评分": 0.02, "风险评分": 0.05,
}
m.bias = 0.0
m.version = "v0-original"
m.save(model_path)
print("Original weights restored:", m.weights)
