class SHAPService:
    """
    SHAP adapter. Real SHAP values must be calculated from the actual
    deployed XGBoost model and the same transformed feature vector used
    for prediction.
    """

    def explain(self, model, transformed_features):
        import shap
        explainer = shap.TreeExplainer(model)
        values = explainer.shap_values(transformed_features)
        return values
