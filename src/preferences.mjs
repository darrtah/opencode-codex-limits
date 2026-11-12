export const intervals = [30000, 60000, 120000, 300000, 600000]
export function validInterval(value) { return intervals.includes(Number(value)) ? Number(value) : 300000 }
const words = {
  'Лимиты Codex': 'Codex limits', 'Лимиты провайдеров': 'Provider limits',
  'Показать остаток': 'Show remaining', 'Показать использованное': 'Show used',
  'Обновить': 'Refresh', 'Осталось': 'Remaining', 'Использовано': 'Used',
  'Переключить остаток и расход': 'Switch between remaining and used',
  'Остаток лимитов': 'Remaining quota',
  'Сброс': 'Resets', 'Сброшено': 'Reset', 'неизвестно': 'unknown',
  'Неделя': 'Week', '5 часов': '5 hours', 'Период': 'Period',
  'Не подключён': 'Not connected', 'Подключён': 'Connected',
  'Данные недоступны': 'Data unavailable',
  'Codex: нет данных': 'Codex: no data',
  'Других лимитов нет или данные недоступны': 'No other limits or data unavailable',
  '! Не удалось обновить; показаны последние данные': '! Refresh failed; showing last known data',
  '! Последние данные: обновление не удалось': '! Last known data: refresh failed',
  'Не удалось обновить данные; повторная попытка через 30 секунд': 'Refresh failed; retrying in 30 seconds',
  'Не удалось обновить; показаны последние данные': 'Refresh failed; showing last known data',
  'Нет данных лимитов': 'No quota data',
  'Численные лимиты не предоставлены OpenAI': 'OpenAI did not provide numerical limits',
  'Данные лимитов не предоставлены OpenAI': 'OpenAI did not provide quota data',
  'Не удалось распознать ответ OpenAI': 'Unrecognized OpenAI response',
  'Не удалось получить данные': 'Failed to fetch data',
  'Не удалось прочитать подключение OpenAI': 'Failed to read OpenAI connection',
  'Аккаунт изменился; обновите данные': 'Account changed; refresh data',
  'В авторизации Codex отсутствует идентификатор аккаунта': 'Codex login has no account ID',
  'С API-ключом лимиты подписки недоступны': 'Subscription limits are unavailable with an API key',
}
export function translate(value, language) {
  if (language !== 'en') return value
  if (words[value]) return words[value]
  return value.replaceAll('5ч', '5h').replaceAll('Неделя', 'Week').replaceAll('Осталось', 'Remaining').replaceAll('Использовано', 'Used').replaceAll(' дн.', ' days').replaceAll(' мин', ' min').replaceAll(' сек', ' sec').replaceAll(' ч', ' h').replaceAll(' — сброс', ' — resets')
}
