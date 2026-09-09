import pytest

from app.services.model_service import ModelService


def test_load_raises_on_missing_model_path(tmp_path):
    bad_path = tmp_path / "does-not-exist"
    svc = ModelService(model_path=str(bad_path))
    with pytest.raises(FileNotFoundError):
        svc.load()

# TODO once model_service.py internals are confirmed, add:
#   - test_load_sets_ready_state(): svc.load() against a real/fixture model
#     artifact, then assert whatever flag/attribute marks it loaded.
#   - test_predict_returns_expected_shape(): call the real predict method
#     (not "predict" if it's named differently) with a known input row and
#     assert the output type/range (e.g. a probability in [0, 1]).
#   - test_unload_releases_resources(): assert the model attribute is None
#     or the underlying object is closed/dereferenced after unload().