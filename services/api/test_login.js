const axios = require("axios");

const credentials = {
  email: "admin@paragonescape.com",
  password: "changeme123!",
  interface: "sentient"
};

axios.post("http://localhost:4000/api/auth/login", credentials, {
  headers: {
    "Content-Type": "application/json",
    "X-Interface": "sentient"
  }
})
.then(response => {
  console.log("SUCCESS! Status:", response.status);
  console.log("Token received:", response.data.token ? "YES" : "NO");
  console.log("User:", response.data.user.email);
  process.exit(0);
})
.catch(error => {
  console.log("ERROR:", error.response?.status, error.response?.data || error.message);
  process.exit(1);
});
