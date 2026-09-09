"""
Basic load test. Run against a running instance (local docker or a
port-forwarded K3s service), NOT by importing the app directly:

    locust -f tests/locustfile.py --host http://localhost:8000

Then open http://localhost:8089 to set concurrent users and spawn rate.
For a scripted/CI run: locust -f tests/locustfile.py --host http://localhost:8000 \
    --headless -u 20 -r 5 -t 1m --csv=loadtest_results
"""
from locust import HttpUser, task, between


class ApiUser(HttpUser):
    wait_time = between(0.5, 2)

    @task(3)
    def health(self):
        self.client.get("/api/v1/health")

    @task(1)
    def metrics(self):
        self.client.get("/metrics")

    # TODO: add the real predict endpoint once confirmed, e.g.
    # @task(5)
    # def predict(self):
    #     self.client.post("/api/v1/predict", json={"transaction_amount": 100.0})
