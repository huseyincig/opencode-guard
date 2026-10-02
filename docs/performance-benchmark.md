# OpenCode V1 performance measurements

These measurements come from a controlled **OpenCode V1 1.18.34** run on **Node.js 24.21.0** using **mimo-v2.6-flash**. They were reported for an earlier v0.3.0-era Guardian revision, **not** measured again against the exact v0.4.0 package. V2 was not tested in this run.

## End-to-end task latency

After one warmup per mode, five task runs were recorded for each configuration. Times include OpenCode, model/API responses and Guardian when enabled; they do not isolate Guardian overhead.

| Configuration | Five measured runs (seconds) | Median |
| --- | --- | ---: |
| Guardian disabled | 15.00, 16.60, 16.98, 23.70, 33.20 | 16.98 s |
| Guardian enabled, preflight disabled | 18.10, 18.25, 20.15, 26.15, 36.16 | 20.15 s |
| Guardian enabled, preflight enabled | 15.34, 16.44, 16.65, 17.80, 18.38 | 16.65 s |

These are observations from **five runs per mode**, not a controlled estimate of added latency. Model/API variability and the small sample prevent attributing differences between medians to Guardian or concluding that preflight makes tasks faster.

## Isolated Guardian timings

| Operation | Recorded time |
| --- | ---: |
| Single preflight classification | 2.33 µs |
| `GuardEngine.inspect` | 0.2167 ms |

The isolated values describe the benchmarked operations and input set, not guaranteed per-call costs on arbitrary projects, shells, hosts or message histories. Do not add them directly to the end-to-end medians to infer production overhead.

## Verification boundary

The earlier V1 host run also exercised the plugin with preflight both on and off. It did not validate the subsequent v0.4.0 changes on a real V1 host. The v0.4.0 source has automated tests and isolated sandbox scenarios; **real V2 host integration and V2 latency remain unmeasured**.

For reproducible automated checks, see [security benchmark](security-benchmark.md), [adapter design](task-contract-v1-v2.md), and [release status](release-v0.4.0.md).
