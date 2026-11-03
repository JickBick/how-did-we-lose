import { createApp } from './app';
const port = Number(process.env.PORT) || 3001;
createApp().listen(port, '0.0.0.0', () => console.log(`How did we lose? Listening on port ${port}`));
