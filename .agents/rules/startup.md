# GeoBot Startup & Execution Guidelines

- When the user asks to start or run the system, launch the services immediately in parallel without running repetitive manual healthcheck loops or sequential verification steps.
- The 3 services are:
  1. ML Microservice: `cd ml && python app.py` (Port 5001)
  2. Backend Express API: `cd server && npm run dev` (Port 4000)
  3. Vite Web Frontend: `cd web && npm run dev` (Port 5173)
- If already running in the background as active daemons, notify the user immediately that the web app is ready at `http://localhost:5173`.
