import logging
import sys


def configure_logging(level: str = "INFO") -> None:
    """
    Configure application-wide logging.
    """
    logging.basicConfig(
        level=level,
        format=(
            "%(asctime)s | "
            "%(levelname)s | "
            "%(name)s | "
            "%(message)s"
        ),
        handlers=[logging.StreamHandler(sys.stdout)],
        force=True,
    )