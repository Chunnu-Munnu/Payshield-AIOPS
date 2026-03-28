# FILE: card_not_present.py
# ROLE: Generate card-not-present fraud transactions
# INSPIRED BY: Ecommerce card fraud signatures
# PERFORMANCE TARGET: Generation under 1ms
def build(seed):
    return {
        "merchantName": "Luxury Retail Web",
        "cardNotPresentFlag": True,
        "deviceSeenBefore": False,
        "merchantFraudRingScore": 0.42,
        "amount": 1200 + seed % 900,
    }
