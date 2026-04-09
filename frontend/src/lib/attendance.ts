export const AFTERNOON_PERIOD_LABEL = 'Afternoon';

export const isAfternoonPeriod = (value?: string | null) => {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue === 'afternoon' || normalizedValue === 'evening';
};

export const formatPeriodLabel = (value?: string | null) => {
  if (!value) {
    return 'General';
  }

  if (isAfternoonPeriod(value)) {
    return AFTERNOON_PERIOD_LABEL;
  }

  if (String(value).trim().toLowerCase() === 'morning') {
    return 'Morning';
  }

  return value;
};

export const matchesSelectedPeriod = (value: string | null | undefined, selectedPeriod: string) => {
  if (!selectedPeriod) {
    return true;
  }

  const normalizedSelectedPeriod = selectedPeriod.trim().toLowerCase();
  const normalizedValue = String(value || 'general').trim().toLowerCase();

  if (normalizedSelectedPeriod === 'afternoon') {
    return isAfternoonPeriod(value);
  }

  return normalizedValue === normalizedSelectedPeriod;
};
