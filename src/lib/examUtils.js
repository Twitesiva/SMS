const normalizeBooleanFlag = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
    return null;
  }
  return Boolean(value);
};

export const isExamResultPublished = (exam = {}) => {
  const flagCandidates = [
    exam.results_published,
    exam.resultsPublished,
    exam.result_published,
    exam.resultPublished,
    exam.is_results_published,
    exam.isResultPublished,
  ];
  for (const candidate of flagCandidates) {
    const normalized = normalizeBooleanFlag(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }
  const status =
    (exam.result_status ||
      exam.resultStatus ||
      exam.status ||
      exam.exam_status ||
      exam.examStatus ||
      ""
    )
      .toString()
      .trim()
      .toLowerCase();
  return (
    status === "published" ||
    status === "result published" ||
    status === "results published"
  );
};

export const getFirstUnpublishedExam = (examList = []) =>
  examList.find((exam) => !isExamResultPublished(exam)) || null;

