import axios from 'axios';

const BASE = '/api';

export async function fetchSummary() {
  const { data } = await axios.get(`${BASE}/summary`);
  return data;
}

export async function fetchProgress() {
  const { data } = await axios.get(`${BASE}/progress`);
  return data;
}

export async function fetchVendor() {
  const { data } = await axios.get(`${BASE}/vendor`);
  return data;
}

export async function fetchDelay() {
  const { data } = await axios.get(`${BASE}/delay`);
  return data;
}

export async function fetchPic() {
  const { data } = await axios.get(`${BASE}/pic`);
  return data;
}

export async function fetchRaw() {
  const { data } = await axios.get(`${BASE}/raw`);
  return data;
}

export async function fetchInsights() {
  const { data } = await axios.get(`${BASE}/insights`);
  return data;
}

export async function fetchMap() {
  const { data } = await axios.get(`${BASE}/map`);
  return data;
}

export async function fetchMapPoints() {
  const { data } = await axios.get(`${BASE}/map-points`);
  return data;
}

export async function fetchAutoInsights() {
  const { data } = await axios.get(`${BASE}/auto-insights`);
  return data;
}
