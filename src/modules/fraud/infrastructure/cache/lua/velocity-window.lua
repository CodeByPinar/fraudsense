-- KEYS[1]: sorted set key
-- ARGV[1]: now timestamp milliseconds
-- ARGV[2]: window start milliseconds
-- ARGV[3]: transaction id
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[2])
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
return redis.call('ZCARD', KEYS[1])
