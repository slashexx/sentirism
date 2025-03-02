rule generic_sensitive_data {
    meta:
        description = "Detect potentially sensitive data"
    strings:
        $password = /password\s*=\s*["'][^"']+["']/
        $api_key = /api[_-]key\s*=\s*["'][^"']+["']/
        $secret = /secret\s*=\s*["'][^"']+["']/
    condition:
        any of them
}
