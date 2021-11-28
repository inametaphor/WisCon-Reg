<?php
// Copyright (c) 2021 BC Holmes. All rights reserved. See copyright document for more details.

require_once("config.php");
require_once("db_common_functions.php");
require_once("jwt_functions.php");
require_once("format_functions.php");

$ini = read_ini();
$conData = find_current_con($ini);

function filter_clause($db, $term) {
    $filterQuery = "";
    if ($term) {
        $id_clause = (is_numeric($term)) ? (" or o.id = " . $term) : "";
        $termPhrase = '%' . mysqli_real_escape_string($db, strtolower($term)) . '%';
        $filterQuery = "and (i.for_name like '" . $termPhrase . "' OR i.email_address like '" . $termPhrase 
            . "' or o.confirmation_email like '" . $termPhrase . "'" . $id_clause . ")";
    }
    return $filterQuery;
}

function find_registrations($conData, $ini, $term, $page, $pageSize) {
    $locale = locale_accept_from_http($_SERVER['HTTP_ACCEPT_LANGUAGE']);

    $db = mysqli_connect($ini['mysql']['host'], $ini['mysql']['user'], $ini['mysql']['password'], $ini['mysql']['db_name']);
    if (!$db) {
        return false;
    } else {
        $filterQuery = filter_clause($db, $term);
        $start = $page * $pageSize;

        $query = <<<EOD
    SELECT 
            o.id, o.confirmation_email, o.status, o.order_uuid, o.payment_method, o.finalized_date, i.for_name, i.email_address, i.amount, off.title
    FROM 
            reg_order o
    LEFT OUTER JOIN reg_order_item i
            ON
                o.id = i.order_id
    LEFT OUTER JOIN reg_offering off
            ON 
                i.offering_id = off.id
    WHERE o.con_id  = ?
        AND o.status in ('CHECKED_OUT', 'PAID')
        $filterQuery
    ORDER BY o.finalized_date, o.id, i.id
    LIMIT $start, $pageSize
    EOD;

        mysqli_set_charset($db, "utf8");
        $stmt = mysqli_prepare($db, $query);
        mysqli_stmt_bind_param($stmt, "i", $conData->id);
        if (mysqli_stmt_execute($stmt)) {

            $items = array();
            $result = mysqli_stmt_get_result($stmt);
            while ($row = mysqli_fetch_object($result)) {
                $current = array(
                    "id" => $row->id, 
                    "confirmation_mail" => $row->confirmation_email,
                    "orderUuid" => $row->order_uuid,
                    "key" => create_order_key($row->id, $row->order_uuid, $row->confirmation_email),
                    "title" => $row->title,
                    "paid" => ($row->status == 'PAID' ? "\"Yes\"" : "\"No\""),
                    "amount" => $row->amount,
                    "for" => $row->for_name,
                    "email_address" => $row->email_address,
                    "payment_method" => format_payment_type_for_display($row->payment_method, $locale)
                );
                if ($row->finalized_date) {
                    $date = date_create_from_format('Y-m-d H:i:s', $row->finalized_date);
                    $current['finalized_date'] = date_format($date, 'c');
                    $current['finalized_date_simple'] = date_format($date, 'M j H:i');
//                    $current['finalized_date'] = $row->finalized_date;
                }
                array_push($items, $current);
            }
            mysqli_stmt_close($stmt);
            mysqli_close($db);
            return $items;
        } else {
            mysqli_close($db);
            return false;
        }
    }
}

function count_registrations($conData, $ini, $term) {
    $db = mysqli_connect($ini['mysql']['host'], $ini['mysql']['user'], $ini['mysql']['password'], $ini['mysql']['db_name']);
    if (!$db) {
        return false;
    } else {
        $filterQuery = filter_clause($db, $term);

        $query = <<<EOD
    SELECT 
            count(*) as row_count
    FROM 
            reg_order o
    LEFT OUTER JOIN reg_order_item i
            ON
                o.id = i.order_id
    LEFT OUTER JOIN reg_offering off
            ON 
                i.offering_id = off.id
    WHERE o.con_id  = ?
        AND o.status in ('CHECKED_OUT', 'PAID')
        $filterQuery
    ORDER BY o.finalized_date, o.id, i.id
    EOD;

        mysqli_set_charset($db, "utf8");
        $stmt = mysqli_prepare($db, $query);
        mysqli_stmt_bind_param($stmt, "i", $conData->id);
        if (mysqli_stmt_execute($stmt)) {

            $count = 0;
            $result = mysqli_stmt_get_result($stmt);
            while ($row = mysqli_fetch_object($result)) {
                $count = $row->row_count;
            }
            mysqli_stmt_close($stmt);
            mysqli_close($db);
            return $count;
        } else {
            mysqli_close($db);
            return false;
        }
    }
}

function determine_links($baseUrl, $items, $count, $PAGE_SIZE) {
    $links = array();
    if (count($items) < $count) {
        $totalPages = floor(($count + $PAGE_SIZE - 1) / $PAGE_SIZE);
        $links['start'] = $baseUrl . 'page=0';
        $links['end'] = $baseUrl . 'page=' . ($totalPages -1);

        for ($i = 0; $i < $totalPages; $i++) {
            $links[$i+1] = $baseUrl . 'page=' . $i;
        }
    }
    return $links;
}

$PAGE_SIZE = 50;
$term = array_key_exists('term', $_REQUEST) ? $_REQUEST['term'] : null;
$page = array_key_exists('page', $_REQUEST) ?$_REQUEST['page'] : null;
if (!$page) {
    $page = 0;
} else {
    $page = ctype_digit($page) ? intval($page) : 0;
}

$count = count_registrations($conData, $ini, $term);
$items = find_registrations($conData, $ini, $term, $page, $PAGE_SIZE);

if ($_SERVER['REQUEST_METHOD'] === 'GET' && !jwt_validate_token(jwt_from_header(), $ini['jwt']['key'], true)) {
    http_response_code(401);
} else if ($items === false) {
    http_response_code(500);
} else {
    $baseUrl = $_SERVER['REQUEST_SCHEME'] . '://' . $_SERVER['SERVER_NAME'] . '/api/registrations_list.php?';
    if ($term) {
        $baseUrl = $baseUrl . 'term=' . urlencode($term) . '&';
    }
    $result = array( "items" => $items, 
        "pagination" => array(
            "start" => (count($items) > 0 ? 1 : 0),
            "end" => count($items),
            "page" => $page,
            "totalRows" => $count
        ),
        "links" => determine_links($baseUrl, $items, $count, $PAGE_SIZE)
    );
    $json_string = json_encode($result);
    echo $json_string;
}

?>