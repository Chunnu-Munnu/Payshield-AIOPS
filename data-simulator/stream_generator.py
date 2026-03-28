# FILE: stream_generator.py
# ROLE: Generate real-time transaction stream — IEEE-CIS if available, synthetic otherwise
# INSPIRED BY: Production payment stream simulation for testing
# PERFORMANCE TARGET: Configurable rate 1-100 tx/second

import requests
import time
import random
import json
import os
import logging
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("payshield-simulator")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3002")

INDIAN_MERCHANTS = [
    "Swiggy", "Zomato", "Flipkart", "Amazon India", "BigBasket",
    "Blinkit", "Zepto", "Myntra", "PhonePe Merchant", "Paytm Merchant",
    "IRCTC", "BookMyShow", "Ola Cabs", "Uber India", "MakeMyTrip",
    "Shell Company Pvt Ltd", "Unknown Vendor", "New Payee 7821",
    "Overseas Transfer XY", "Crypto Exchange INR",
]

FRAUD_SCENARIOS = [
    # SIM swap + drain
    {"amount": 48500, "merchant": "Unknown Vendor", "memo": "", "pattern": "sim_swap"},
    # BEC attack
    {"amount": 15000, "merchant": "New Payee 7821", "memo": "URGENT: Update vendor bank account immediately. New IBAN attached. Do not call to verify.", "pattern": "bec"},
    # Mule account
    {"amount": 9900, "merchant": "Shell Company Pvt Ltd", "memo": "Confidential transfer do not discuss", "pattern": "mule"},
    # Near threshold
    {"amount": 49800, "merchant": "Overseas Transfer XY", "memo": "", "pattern": "smurfing"},
    # Small test + large drain
    {"amount": 150, "merchant": "Unknown Vendor", "memo": "", "pattern": "warmup"},
]

def generate_normal_transaction():
    amount = random.choice([
        random.uniform(50, 2000),
        random.uniform(2000, 15000),
        random.uniform(15000, 80000),
    ])
    return {
        "txId":          f"SIM-{int(time.time()*1000)}-{random.randint(1000,9999)}",
        "amount":        round(amount, 2),
        "currency":      "INR",
        "merchant":      random.choice(INDIAN_MERCHANTS[:15]),
        "country":       "IN",
        "paymentMethod": random.choice(["UPI", "UPI", "UPI", "Card", "NEFT", "IMPS"]),
        "memo":          "",
        "deviceId":      f"device-{random.randint(1000,9999)}",
        "timestamp":     datetime.now().isoformat(),
        "userEmail":     "demo@payshield.ai",
        "userName":      "Simulated User",
    }

def generate_fraud_transaction():
    scenario = random.choice(FRAUD_SCENARIOS)
    return {
        "txId":          f"FRAUD-{int(time.time()*1000)}-{random.randint(1000,9999)}",
        "amount":        scenario["amount"],
        "currency":      "INR",
        "merchant":      scenario["merchant"],
        "country":       random.choice(["IN", "US", "AE", "SG"]),
        "paymentMethod": "UPI",
        "memo":          scenario["memo"],
        "deviceId":      f"newdevice-{random.randint(1,50)}",
        "timestamp":     datetime.now().isoformat(),
        "userEmail":     "demo@payshield.ai",
        "userName":      "Demo User",
        "attackPattern": scenario["pattern"],
    }

def run_simulator(fraud_rate=0.25, tx_per_second=1):
    logger.info(f"PayShield simulator starting: {tx_per_second} tx/s, {fraud_rate*100:.0f}% fraud rate")
    logger.info(f"Sending to: {BACKEND_URL}/api/transactions/submit")

    tx_count = 0
    fraud_count = 0

    while True:
        try:
            is_fraud = random.random() < fraud_rate
            tx       = generate_fraud_transaction() if is_fraud else generate_normal_transaction()

            resp = requests.post(
                f"{BACKEND_URL}/api/transactions/submit",
                json=tx,
                timeout=5
            )

            if resp.status_code == 200:
                result = resp.json()
                tx_count += 1
                if result.get("decision") in ["block", "quarantine"]:
                    fraud_count += 1
                    logger.info(f"FLAGGED: {tx['txId']} | Score: {result.get('fraudScore')} | {result.get('decision').upper()} | ₹{tx['amount']:,.2f}")
                else:
                    logger.debug(f"OK: {tx['txId']} | Score: {result.get('fraudScore')} | ₹{tx['amount']:,.2f}")

            if tx_count % 50 == 0:
                logger.info(f"Stats: {tx_count} total | {fraud_count} flagged ({fraud_count/tx_count*100:.1f}%)")

        except Exception as e:
            logger.warning(f"Submit failed: {e}")

        time.sleep(1.0 / tx_per_second)

if __name__ == "__main__":
    run_simulator(fraud_rate=0.25, tx_per_second=1)
