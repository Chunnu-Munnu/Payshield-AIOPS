# FILE: account_takeover.py
# ROLE: Generate account takeover transactions
# INSPIRED BY: Session hijack and credential-stuffing fraud signatures
# PERFORMANCE TARGET: Generation under 1ms
def build(seed):
    return {
        "merchantName": "Travel Wallet Hub",
        "vpnProxyTorDetected": True,
        "deviceSeenBefore": False,
        "simSwapDetected": True,
        "amount": 2000 + seed % 3000,
    }
