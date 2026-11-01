import argparse, json
from pathlib import Path
import joblib, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, classification_report
from xgboost import XGBClassifier

FEATURES=["N","P","K","temperature","humidity","ph","rainfall"]

def main():
    p=argparse.ArgumentParser(description="Train the research crop-recommendation XGBoost model.")
    p.add_argument("--csv",required=True)
    p.add_argument("--out",default="../../models")
    a=p.parse_args()
    out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    df=pd.read_csv(a.csv)
    label_col="label" if "label" in df.columns else ("Crop" if "Crop" in df.columns else None)
    if label_col is None: raise ValueError("Dataset must contain label or Crop column")
    missing=[c for c in FEATURES if c not in df.columns]
    if missing: raise ValueError(f"Missing required features: {missing}")
    df=df.dropna(subset=FEATURES+[label_col]).copy()
    X=df[FEATURES].astype(float); le=LabelEncoder(); y=le.fit_transform(df[label_col].astype(str))
    Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=.2,random_state=42,stratify=y)
    model=XGBClassifier(n_estimators=500,max_depth=6,learning_rate=.05,subsample=.9,
        colsample_bytree=.9,objective="multi:softprob",eval_metric="mlogloss",
        random_state=42,n_jobs=4,tree_method="hist")
    model.fit(Xtr,ytr)
    pred=model.predict(Xte)
    precision,recall,f1,_=precision_recall_fscore_support(yte,pred,average="weighted",zero_division=0)
    model.save_model(out/"crop_xgboost.json"); joblib.dump(le,out/"crop_label_encoder.joblib")
    metrics={"accuracy":float(accuracy_score(yte,pred)),"weighted_precision":float(precision),
             "weighted_recall":float(recall),"weighted_f1":float(f1),"features":FEATURES,
             "samples":int(len(df)),"classes":list(le.classes_),"test_samples":int(len(yte))}
    (out/"crop_model_metrics.json").write_text(json.dumps(metrics,indent=2))
    manifest={"model_version":"xgboost-research-1.0","status":"TRAINED_ON_USER_SUPPLIED_REAL_DATASET",
              "features":FEATURES,"label_column":label_col,"metrics_file":"crop_model_metrics.json",
              "dataset_file":Path(a.csv).name}
    (out/"crop_model_manifest.json").write_text(json.dumps(manifest,indent=2))
    print(json.dumps(metrics,indent=2))

if __name__=="__main__": main()
