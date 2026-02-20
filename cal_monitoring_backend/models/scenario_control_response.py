from pydantic import BaseModel


class ScenarioControlResponse(BaseModel):
    message: str
    scenario_started: str
