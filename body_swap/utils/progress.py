import time


class Timer:
    def __init__(self, label: str = ""):
        self.label = label
        self._start = None

    def __enter__(self):
        self._start = time.time()
        return self

    def __exit__(self, *_):
        elapsed = time.time() - self._start
        print(f"[{self.label}] {elapsed:.1f}s")
