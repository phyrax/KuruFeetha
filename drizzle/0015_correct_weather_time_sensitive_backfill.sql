UPDATE `news_cards`
SET `is_time_sensitive` = 1
WHERE `category_id` IN (
  SELECT `id`
  FROM `categories`
  WHERE lower(`name_en`) = 'weather'
     OR lower(`slug`) LIKE 'weather%'
);
