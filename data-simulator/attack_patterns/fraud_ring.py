# FILE: fraud_ring.py
# ROLE: Generate fraud-ring transactions with circular flow indicators
# INSPIRED BY: Ring and mule-network fraud topologies
# PERFORMANCE TARGET: Generation under 1ms
def build(seed):
    return {
        "merchantName": "Shell Merchant Cluster",
        "sharedDeviceCount": 6,
        "merchantFraudRingScore": 0.96,
        "circularFlowDetected": True,
        "transactionChainDepth": 7,
        "amount": 7000 + seed % 5000,
    }
