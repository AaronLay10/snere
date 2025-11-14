"use client";

import axios, { AxiosInstance } from 'axios';

const DEFAULT_API_URL = 'http://localhost:3000';

const resolveBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const current = new URL(window.location.href);
    const apiPort = process.env.NEXT_PUBLIC_API_PORT ?? '3000';
    return `${current.protocol}//${current.hostname}:${apiPort}`;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_URL;
};

let client: AxiosInstance | null = null;

const getApiClient = (): AxiosInstance => {
  if (!client) {
    client = axios.create({
      baseURL: resolveBaseUrl(),
      timeout: 5000
    });
  }
  return client;
};

export const fetcher = async (url: string) => {
  const response = await getApiClient().get(url);
  return response.data;
};

export const getApiBaseUrl = (): string => resolveBaseUrl();

export const deleteDevice = async (deviceId: string) => {
  await getApiClient().delete(`/devices/${encodeURIComponent(deviceId)}`);
};

export const publishMqttMessage = async (topic: string, payload: string | object) => {
  const response = await getApiClient().post('/api/mqtt/publish', {
    topic,
    payload
  });
  return response.data;
};
