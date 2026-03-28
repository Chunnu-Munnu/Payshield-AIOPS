const { ethers, network } = require("hardhat");
const axios = require("axios");
const fs = require("fs");

async function main() {
  console.log("Starting the process to log API data to the blockchain...");

  const API_URL = "http://127.0.0.1:8000/predict";

  const SatelliteCommandLogFactory = await ethers.getContractFactory(
    "SatelliteCommandLog"
  );

  const deployedContractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  
  const satelliteCommandLog = await SatelliteCommandLogFactory.attach(
    deployedContractAddress
  );

  const telemetryData = {
    timestamp: "2026-02-15 11:30:00",
    satellite_id: "SAT-42",
    ground_station_id: "GS-BLR",
    command_type: "ORBIT_ADJUST",
    parameters: "thrust=5s, angle=2.5deg",
    checksum: "valid",
    status: "pending",
    speed: 7.66,
    radius: 6778,
    payload: "antenna:deploy, power=95%",
  };

  let apiResponse;
  try {
    console.log("\nSending data to the Anomaly Detector API...");
    console.log("Request Data:", telemetryData);

    const response = await axios.post(API_URL, telemetryData);
    apiResponse = response.data;

    console.log("Received response from API:");
    console.log("API Response:", apiResponse);
  } catch (error) {
    console.error(
      "\nError calling the API. Make sure the FastAPI server is running."
    );
    console.error(error.message);
    process.exit(1);
  }

  const commandDataString = JSON.stringify(telemetryData);
  const responseDataString = JSON.stringify(apiResponse);

  console.log("\nLogging command and response to the smart contract...");
  const transactionResponse = await satelliteCommandLog.addLog(
    commandDataString,
    responseDataString
  );
  
  await transactionResponse.wait(1);
  console.log("Log successfully added to the blockchain!");
  console.log("Transaction Hash:", transactionResponse.hash);

  const logIndex = (await satelliteCommandLog.getLogCount()) - 1;
  console.log(`\nRetrieving log at index ${logIndex} to verify...`);
  const [command, response, timestamp, operator] = await satelliteCommandLog.getLog(
    logIndex
  );

  console.log(`\n--- Verification of Log ${logIndex} ---`);
  console.log("  Command Data:", JSON.parse(command));
  console.log("  Response Data:", JSON.parse(response));
  console.log(
    `  Timestamp: ${new Date(Number(timestamp) * 1000).toUTCString()}`
  );
  console.log(`  Operator: ${operator}`);
  console.log(`------------------------------`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
