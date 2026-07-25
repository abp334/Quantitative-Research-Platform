"""Tests for walk-forward split generation."""

from app.ml.evaluation.walk_forward import expanding_walk_forward_splits


def test_walk_forward_expanding() -> None:
    folds = expanding_walk_forward_splits(
        n_samples=1000,
        min_train=300,
        test_size=100,
        step_size=100,
        max_folds=8,
    )
    assert 1 <= len(folds) <= 8
    # Expanding: each fold train_end grows
    for i in range(1, len(folds)):
        assert folds[i].train_end > folds[i - 1].train_end
    # No overlap of test into prior train incorrectly
    for fold in folds:
        assert fold.test_start == fold.train_end
        assert fold.test_end > fold.test_start


def test_walk_forward_caps_folds_on_large_n() -> None:
    folds = expanding_walk_forward_splits(
        n_samples=20000,
        min_train=756,
        test_size=126,
        step_size=126,
        max_folds=8,
    )
    assert len(folds) <= 8


def test_walk_forward_insufficient_data() -> None:
    folds = expanding_walk_forward_splits(100, min_train=80, test_size=50, step_size=10)
    assert folds == []
