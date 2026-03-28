# FILE: gnn_model.py
# ROLE: Graph Neural Network model representation
import logging

logger = logging.getLogger("payshield-gnn")

class GNNModel:
    _instance = None

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.trained = True
        logger.info("GNN Model initialized (mocked for demo latency).")

    def predict(self, features, txId, userId):
        # Implementation is handled straight in the router for demo
        pass
