package org.springframework.http;

public interface HttpStatusCode {
    int value();
    static HttpStatusCode valueOf(int code) {
        return HttpStatus.valueOf(code);
    }
}
