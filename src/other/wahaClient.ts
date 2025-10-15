import axios, { AxiosInstance } from "axios";

// WAHA API client configuration
export const wahaClient: AxiosInstance = axios.create({
  baseURL: process.env.WAHA_BASE_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.WAHA_AUTH_TOKEN ? `${process.env.WAHA_AUTH_TOKEN}` : '',
  },
  timeout: 30000, // 30 seconds timeout
});