<?php
// api.php - REST API для работы с заметками на сервере
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка preflight запросов
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Файл для хранения заметок
$notesFile = __DIR__ . '/data/notes.json';

// Создание директории для данных, если её нет
if (!file_exists(__DIR__ . '/data')) {
    mkdir(__DIR__ . '/data', 0755, true);
}

// Функция для чтения заметок
function getNotes() {
    global $notesFile;
    if (file_exists($notesFile)) {
        $content = file_get_contents($notesFile);
        return json_decode($content, true) ?: [];
    }
    return [];
}

// Функция для сохранения заметок
function saveNotes($notes) {
    global $notesFile;
    return file_put_contents($notesFile, json_encode($notes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// Обработка запросов
$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($method) {
    case 'GET':
        $notes = getNotes();
        
        // Фильтрация заметок
        if (isset($_GET['filter'])) {
            $filter = $_GET['filter'];
            $today = date('Y-m-d');
            $weekAgo = date('Y-m-d', strtotime('-7 days'));
            
            switch ($filter) {
                case 'today':
                    $notes = array_filter($notes, function($note) use ($today) {
                        return $note['date'] === $today;
                    });
                    break;
                case 'week':
                    $notes = array_filter($notes, function($note) use ($weekAgo) {
                        return $note['date'] >= $weekAgo;
                    });
                    break;
            }
            
            // Сортировка по дате
            usort($notes, function($a, $b) {
                return strtotime($b['date']) - strtotime($a['date']);
            });
        }
        
        echo json_encode(array_values($notes));
        break;
        
    case 'POST':
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (isset($input['action']) && $input['action'] === 'add') {
            $notes = getNotes();
            $newNote = [
                'id' => time() . '_' . rand(1000, 9999),
                'text' => htmlspecialchars($input['text'], ENT_QUOTES, 'UTF-8'),
                'date' => $input['date'],
                'createdAt' => date('Y-m-d H:i:s')
            ];
            $notes[] = $newNote;
            
            if (saveNotes($notes)) {
                echo json_encode(['success' => true, 'note' => $newNote]);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'error' => 'Не удалось сохранить заметку']);
            }
        }
        break;
        
    case 'DELETE':
        $input = json_decode(file_get_contents('php://input'), true);
        $id = isset($input['id']) ? $input['id'] : (isset($_GET['id']) ? $_GET['id'] : null);
        
        if ($id) {
            $notes = getNotes();
            $initialCount = count($notes);
            $notes = array_filter($notes, function($note) use ($id) {
                return $note['id'] != $id;
            });
            
            if (count($notes) !== $initialCount && saveNotes(array_values($notes))) {
                echo json_encode(['success' => true]);
            } else {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Заметка не найдена']);
            }
        } else {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID не указан']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Метод не поддерживается']);
}