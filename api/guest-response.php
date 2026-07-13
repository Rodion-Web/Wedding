<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function cleanText(mixed $value, int $maxLength = 120): string
{
    if (!is_string($value)) {
        return '';
    }

    $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    return mb_substr($value, 0, $maxLength);
}

function spreadsheetSafe(string $value): string
{
    return preg_match('/^[=+\-@]/u', $value) === 1 ? "'" . $value : $value;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    header('Allow: POST');
    respond(405, ['ok' => false, 'message' => 'Разрешён только POST-запрос.']);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    respond(415, ['ok' => false, 'message' => 'Ожидается JSON.']);
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) > 20000) {
    respond(413, ['ok' => false, 'message' => 'Некорректный размер запроса.']);
}

$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    respond(400, ['ok' => false, 'message' => 'Некорректный JSON.']);
}

// Honeypot: bots often fill this invisible field.
if (cleanText($payload['website'] ?? '') !== '') {
    respond(200, ['ok' => true]);
}

$guestName = cleanText($payload['guestName'] ?? '');
$attendance = cleanText($payload['attendance'] ?? '', 12);
$company = cleanText($payload['company'] ?? '', 16);
$companionName = cleanText($payload['companionName'] ?? '');
$drinks = $payload['drinks'] ?? [];

if (mb_strlen($guestName) < 2) {
    respond(422, ['ok' => false, 'message' => 'Укажите имя гостя.']);
}

if (!in_array($attendance, ['yes', 'no'], true)) {
    respond(422, ['ok' => false, 'message' => 'Укажите присутствие.']);
}

if (!in_array($company, ['alone', 'withGuest'], true)) {
    respond(422, ['ok' => false, 'message' => 'Укажите количество гостей.']);
}

if ($company === 'withGuest' && mb_strlen($companionName) < 2) {
    respond(422, ['ok' => false, 'message' => 'Укажите имя сопровождающего.']);
}

if (!is_array($drinks)) {
    $drinks = [];
}

$drinkLabels = [
    'whiteWine' => 'Вино белое',
    'redWine' => 'Вино красное',
    'pomegranateWine' => 'Вино гранатовое',
    'vodka' => 'Водка',
    'whiskey' => 'Виски',
    'none' => 'Не пьёт алкоголь',
];

$selectedDrinks = [];
foreach (array_slice($drinks, 0, 6) as $drink) {
    if (is_string($drink) && isset($drinkLabels[$drink])) {
        $selectedDrinks[$drink] = $drinkLabels[$drink];
    }
}

if (isset($selectedDrinks['none'])) {
    $selectedDrinks = ['none' => $drinkLabels['none']];
}

$dataDirectory = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data';
$csvPath = $dataDirectory . DIRECTORY_SEPARATOR . 'guest-responses.csv';

if (!is_dir($dataDirectory) && !mkdir($dataDirectory, 0750, true) && !is_dir($dataDirectory)) {
    respond(500, ['ok' => false, 'message' => 'Не удалось создать папку для ответов.']);
}

$handle = fopen($csvPath, 'c+b');
if ($handle === false) {
    respond(500, ['ok' => false, 'message' => 'Не удалось открыть файл ответов.']);
}

if (!flock($handle, LOCK_EX)) {
    fclose($handle);
    respond(500, ['ok' => false, 'message' => 'Файл ответов временно недоступен.']);
}

$stat = fstat($handle);
$isNewFile = ($stat['size'] ?? 0) === 0;
fseek($handle, 0, SEEK_END);

if ($isNewFile) {
    fwrite($handle, "\xEF\xBB\xBF");
    fputcsv($handle, [
        'Дата заполнения',
        'Имя гостя',
        'Присутствие',
        'С кем придёт',
        'Имя сопровождающего',
        'Напитки',
    ], ';', '"', '');
}

date_default_timezone_set('Europe/Moscow');
$row = [
    date('d.m.Y H:i:s'),
    spreadsheetSafe($guestName),
    $attendance === 'yes' ? 'Будет присутствовать' : 'Не сможет присутствовать',
    $company === 'withGuest' ? 'С сопровождающим' : 'Один',
    spreadsheetSafe($companionName),
    implode(', ', $selectedDrinks) ?: 'Не указано',
];

$written = fputcsv($handle, $row, ';', '"', '') !== false;
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

if (!$written) {
    respond(500, ['ok' => false, 'message' => 'Не удалось сохранить ответ.']);
}

respond(201, ['ok' => true, 'message' => 'Ответ сохранён.']);

