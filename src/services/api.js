import axios from "axios";

const API = axios.create({
  baseURL: "https://ai-voice-based-bot-be.onrender.com/api"   // 🔥 HARD FIX
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");

  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }

  return req;
});

export default API;