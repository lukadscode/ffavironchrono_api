const axios = require("axios");

module.exports = async (path) => {
  const url = `https://intranet.ffaviron.fr/api/v1${path}`; // <== adapte ici

  const res = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${process.env.EXTERNAL_API_TOKEN}`,
    },
  });

  return res.data;
};
