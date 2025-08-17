export const getOverallStudyType = async () => {

  const response = await fetch("/api/static_data/overall_study_type");
  const data = await response.json();
  return data;
};

export const getDrugList = async () => {
  const response = await fetch("/api/static_data/druglist");
  const data = await response.json();
  return data;
};

export const getDiseaseList = async () => {
  const response = await fetch("/api/static_data/disease");
  const data = await response.json();
  return data;
};

export const postTest = async () => {
  const response = await fetch("/api/test", {
    method: "POST",
  });
  const data = await response.json();
  return data;
};

