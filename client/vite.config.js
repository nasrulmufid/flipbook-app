import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		allowedHosts: ['win.kmserver.my.id', 'localhost', '127.0.0.1'],
		proxy: {
			'/api': 'http://localhost:3001',
			'/uploads': 'http://localhost:3001',
		},
	},
	build: { chunkSizeWarningLimit: 900 },
});
