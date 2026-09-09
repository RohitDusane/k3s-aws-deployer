import sys

import joblib
import numpy
import pandas
import scipy
import sklearn


MODEL_PATH = "models/fraud_pipeline.joblib"


print("=" * 60)
print("Python / ML Environment")
print("=" * 60)

print("Python:       ", sys.version)
print("NumPy:        ", numpy.__version__)
print("Pandas:       ", pandas.__version__)
print("SciPy:        ", scipy.__version__)
print("Scikit-learn: ", sklearn.__version__)
print("Joblib:       ", joblib.__version__)

print()
print("=" * 60)
print("Loading Model")
print("=" * 60)

model = joblib.load(MODEL_PATH)

print("Model type:", type(model))

if hasattr(model, "named_steps"):
    print()
    print("Pipeline steps:")

    for name, step in model.named_steps.items():
        print(f"  {name}: {type(step)}")

if hasattr(model, "classes_"):
    print()
    print("Classes:", model.classes_)

print()
print("Model loaded successfully.")
