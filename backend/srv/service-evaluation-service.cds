@path: '/service-evaluations'
@requires: 'authenticated-user'
service ServiceEvaluationService {
  type EvaluationQuestion {
    id: UUID;
    appId: String(100);
    question: String(1000);
    questionAr: String(1000);
    minScore: Integer;
    maxScore: Integer;
    displayOrder: Integer;
    active: Boolean;
  }
  type EvaluationSubmissionResult {
    evaluationId: UUID;
    appId: String(100);
    requestUuid: UUID;
    averageScore: Decimal(10,2);
    averagePercent: Decimal(10,2);
    questionCount: Integer;
    status: String(30);
  }
  type ApplicationEvaluationStatistics {
    appId: String(100);
    evaluationCount: Integer;
    averageScore: Decimal(10,2);
    averagePercent: Decimal(10,2);
    minimumScore: Decimal(10,2);
    maximumScore: Decimal(10,2);
    commentsCount: Integer;
  }
  type QuestionEvaluationStatistics {
    appId: String(100);
    questionId: UUID;
    question: String(1000);
    questionAr: String(1000);
    evaluationCount: Integer;
    averageScore: Decimal(10,2);
    averagePercent: Decimal(10,2);
    commentsCount: Integer;
  }

  function getEvaluationQuestions(appId: String(100)) returns many EvaluationQuestion;
  action submitServiceEvaluation(payload: LargeString) returns EvaluationSubmissionResult;

  // Portal administrator operations.
  action upsertEvaluationQuestion(payload: LargeString) returns EvaluationQuestion;
  action archiveEvaluationQuestion(questionId: UUID) returns Boolean;
  function getEvaluationReport(startDate: String(10), endDate: String(10), appId: String(100)) returns many ApplicationEvaluationStatistics;
  function getQuestionEvaluationReport(startDate: String(10), endDate: String(10), appId: String(100)) returns many QuestionEvaluationStatistics;
}
