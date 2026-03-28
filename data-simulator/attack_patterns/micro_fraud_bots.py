# FILE: micro_fraud_bots.py
# ROLE: Generate micro-bot burst transactions
# INSPIRED BY: Bot-driven card testing attacks
# PERFORMANCE TARGET: Generation under 1ms
def build(seed):
    return {
        "merchantName": "Gift Card Node",
        "failedAttempts": 8,
        "transactionChainDepth": 9,
        "copyPasteRatio": 0.88,
        "amount": 10 + seed % 80,
    }
