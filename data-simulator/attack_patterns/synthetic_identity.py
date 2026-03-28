# FILE: synthetic_identity.py
# ROLE: Generate synthetic identity fraud transactions
# INSPIRED BY: First-party fraud and mule account signatures
# PERFORMANCE TARGET: Generation under 1ms
def build(seed):
    return {
        "merchantName": "Instant Credit Broker",
        "sharedIpCount": 5,
        "sharedDeviceCount": 4,
        "merchantFraudRingScore": 0.68,
        "amount": 800 + seed % 1500,
    }
