import 'dotenv/config';

export default {
  expo: {
    name: "Trackeador de Habitos",
    slug: "seu-app",
    version: "1.0.0",
    extra: {
      API_BASE_URL: process.env.API_BASE_URL,
    },
  },
};
