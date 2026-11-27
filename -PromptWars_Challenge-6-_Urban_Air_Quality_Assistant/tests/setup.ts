import '@testing-library/jest-dom/vitest';

process.env.OFFLINE_MODE = 'true';
delete process.env.GEMINI_API_KEY;
