import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 8080,
  env: process.env.NODE_ENV || 'development',
  streamToken: process.env.STREAM_TOKEN || 'dev-token',
};