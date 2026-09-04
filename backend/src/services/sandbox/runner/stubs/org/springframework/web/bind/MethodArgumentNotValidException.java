package org.springframework.web.bind;

import org.springframework.validation.BindingResult;

public class MethodArgumentNotValidException extends Exception {
    private final BindingResult bindingResult;

    public MethodArgumentNotValidException(BindingResult bindingResult) {
        this.bindingResult = bindingResult;
    }

    public BindingResult getBindingResult() {
        return bindingResult;
    }
}
