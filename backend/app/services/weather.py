import httpx

class WeatherService:
    def __init__(self, api_key: str = "", provider: str = "open-meteo"):
        self.api_key = api_key
        self.provider = provider or "open-meteo"

    async def current(self, latitude: float, longitude: float):
        if self.provider.lower() not in {"open-meteo", "open_meteo"}:
            return {"available": False, "demo_mode": True,
                    "message": f"Unsupported weather provider: {self.provider}"}
        params={
            "latitude": latitude, "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,precipitation,rain,wind_speed_10m",
            "hourly": "precipitation_probability,rain,temperature_2m,relative_humidity_2m",
            "forecast_days": 1, "timezone": "auto"
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r=await client.get("https://api.open-meteo.com/v1/forecast", params=params)
                r.raise_for_status(); data=r.json()
            return {"available":True,"demo_mode":False,"provider":"open-meteo",
                    "latitude":latitude,"longitude":longitude,
                    "current":data.get("current",{}),"hourly":data.get("hourly",{})}
        except Exception as exc:
            return {"available":False,"demo_mode":True,"message":f"Weather request failed: {exc}"}
