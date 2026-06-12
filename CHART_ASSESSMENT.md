# Chart feasibility assessment

## Prototype chart / feature status

| Area | Prototype expectation | Actual data status | Result |
|---|---|---|---|
| Top metric cards | Overall response count and NPS by five NPS intents | Available in `DLS_NPS_06102026.csv` | Possible |
| NPS radar | NPS by intent across periods | Available, but periods are `Fall_2025` and `Spring_2026` | Possible after dynamic period mapping |
| Persona NPS bars | NPS by group and intent | Available for Alumni, Parent, Student, Staff, Teaching Faculty | Possible |
| Student grade distribution | Student grade field in responses | Available as `Which grade are you currently in? (required)` | Possible |
| Tenure pie chart | Student tenure in prototype | Available, but group-specific fields differ | Possible after mapping student/parent/staff/alumni tenure fields |
| Experience tab | Display values and numeric scores | Available in `DLS_Responses_06102026.csv` for Experience | Possible with scale caveat |
| Foundations | Agreement-style questions | Available in `DLS_Responses_06102026.csv` | Possible |
| Feedback verbatims | Open text responses | Available in `Value` for Feedback rows | Possible |
| Sentiment charts | Sentiment score/label | Not present in uploaded CSVs | Not possible without a scored sentiment file or in-app scoring |

## Important mapping issues found

1. The prototype used mock arrays and did not ingest the real files.
2. The prototype hard-coded periods of `2023-2024` and `2022-2023`; the data contains `Fall_2025` and `Spring_2026`.
3. The prototype expected simplified field names such as `Group_Desc` and `ResponseNumeric`; the NPS CSV uses `Which group best describes you?` and `Response`.
4. The NPS intent label in the real data is `2. Quality & Workload of Education`, while the prototype expected `2. Quality & Workload`.
5. Staff appears as both `Staff member` and `Teaching Faculty`; the package normalizes `Staff member` to `Staff` but keeps `Teaching Faculty` separate.
