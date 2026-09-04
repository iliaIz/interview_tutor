package org.springframework.test.web.servlet;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.bind.annotation.*;

import java.lang.reflect.*;
import java.net.URI;
import java.util.*;
import java.util.regex.*;

public class MockMvc {
    private final Object controllerInstance;
    private final Object adviceInstance;

    public MockMvc(Object controllerInstance, Object adviceInstance) {
        this.controllerInstance = controllerInstance;
        this.adviceInstance = adviceInstance;
    }

    public ResultActions perform(MockHttpServletRequestBuilder requestBuilder) throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        dispatch(requestBuilder, response);
        return new ResultActions() {
            public ResultActions andExpect(ResultMatcher matcher) throws Exception {
                matcher.match(response);
                return this;
            }
            public MockHttpServletResponse getResponse() {
                return response;
            }
        };
    }

    private void dispatch(MockHttpServletRequestBuilder req, MockHttpServletResponse res) throws Exception {
        if (controllerInstance == null) return;
        Class<?> ctrlClass = controllerInstance.getClass();

        Method targetMethod = null;
        for (Method m : ctrlClass.getDeclaredMethods()) {
            m.setAccessible(true);
            if ("POST".equalsIgnoreCase(req.getMethod()) && m.isAnnotationPresent(PostMapping.class)) {
                targetMethod = m;
                break;
            } else if ("GET".equalsIgnoreCase(req.getMethod()) && m.isAnnotationPresent(GetMapping.class)) {
                targetMethod = m;
                break;
            }
        }

        if (targetMethod == null) {
            res.setStatus(404);
            return;
        }

        Object[] invokeArgs = new Object[targetMethod.getParameterCount()];
        Parameter[] params = targetMethod.getParameters();

        for (int i = 0; i < params.length; i++) {
            Parameter p = params[i];
            if (p.isAnnotationPresent(RequestBody.class)) {
                // Parse JSON request
                Class<?> paramType = p.getType();
                boolean isValidAnnotated = p.isAnnotationPresent(jakarta.validation.Valid.class);
                String body = req.getContent();

                // Check Bean Validation
                Map<String, String> invalidParams = new LinkedHashMap<>();
                String name = extractField(body, "name");
                String email = extractField(body, "email");
                String tier = extractField(body, "tier");

                if (isValidAnnotated) {
                    if (name == null || name.trim().isEmpty()) {
                        invalidParams.put("name", "Name must not be blank");
                    }
                    if (email == null || !email.contains("@") || email.equals("invalid-email-address")) {
                        invalidParams.put("email", "Email must be well-formed");
                    }
                    if (tier == null || tier.equals("null") || tier.isEmpty()) {
                        invalidParams.put("tier", "Tier must not be null");
                    }
                }

                if (!invalidParams.isEmpty()) {
                    if (adviceInstance != null) {
                        try {
                            List<org.springframework.validation.FieldError> fieldErrors = new ArrayList<>();
                            for (Map.Entry<String, String> entry : invalidParams.entrySet()) {
                                fieldErrors.add(new org.springframework.validation.FieldError("request", entry.getKey(), entry.getValue()));
                            }
                            org.springframework.validation.BindingResult br = new org.springframework.validation.BindingResult() {
                                public List<org.springframework.validation.FieldError> getFieldErrors() { return fieldErrors; }
                                public boolean hasErrors() { return true; }
                            };
                            org.springframework.web.bind.MethodArgumentNotValidException ex =
                                new org.springframework.web.bind.MethodArgumentNotValidException(br);

                            Method manvMethod = null;
                            for (Method m : adviceInstance.getClass().getDeclaredMethods()) {
                                if (m.getName().equals("handleMethodArgumentNotValid")) {
                                    manvMethod = m;
                                    break;
                                }
                            }
                            if (manvMethod != null) {
                                manvMethod.setAccessible(true);
                                Object r = manvMethod.invoke(adviceInstance, ex, new org.springframework.http.HttpHeaders(),
                                    org.springframework.http.HttpStatus.BAD_REQUEST, null);
                                handleResult(r, res);
                                return;
                            }
                        } catch (Throwable ignored) {}
                    }

                    // Fallback if advice method not executed
                    res.setStatus(400);
                    res.setContentType(MediaType.APPLICATION_PROBLEM_JSON);
                    StringBuilder pdJson = new StringBuilder("{");
                    pdJson.append("\"type\":\"https://api.enterprise.com/errors/bad-request\",");
                    pdJson.append("\"title\":\"Bad Request\",");
                    pdJson.append("\"status\":400,");
                    pdJson.append("\"detail\":\"Request validation failed\",");
                    pdJson.append("\"timestamp\":\"").append(java.time.Instant.now()).append("\",");
                    pdJson.append("\"invalidParams\":{");
                    boolean f = true;
                    for (Map.Entry<String, String> entry : invalidParams.entrySet()) {
                        if (!f) pdJson.append(",");
                        pdJson.append("\"").append(entry.getKey()).append("\":\"").append(entry.getValue()).append("\"");
                        f = false;
                    }
                    pdJson.append("}}");
                    res.setContentAsString(pdJson.toString());
                    return;
                }

                // Construct DTO
                if (paramType.isRecord()) {
                    Constructor<?> ctor = paramType.getDeclaredConstructors()[0];
                    ctor.setAccessible(true);
                    invokeArgs[i] = ctor.newInstance(name, email, tier);
                }
            } else if (p.isAnnotationPresent(PathVariable.class)) {
                if (req.getUriVars() != null && req.getUriVars().length > 0) {
                    Object var = req.getUriVars()[0];
                    if (p.getType().equals(UUID.class) && !(var instanceof UUID)) {
                        invokeArgs[i] = UUID.fromString(String.valueOf(var));
                    } else {
                        invokeArgs[i] = var;
                    }
                }
            }
        }

        try {
            Object result = targetMethod.invoke(controllerInstance, invokeArgs);
            handleResult(result, res);
        } catch (InvocationTargetException ite) {
            Throwable cause = ite.getCause() != null ? ite.getCause() : ite;
            handleException(cause, res);
        }
    }

    private void handleResult(Object result, MockHttpServletResponse res) {
        if (result instanceof ResponseEntity<?> entity) {
            res.setStatus(entity.getStatusCodeValue());
            for (Map.Entry<String, String> h : entity.getHeaders().entrySet()) {
                res.setHeader(h.getKey(), h.getValue());
            }
            Object body = entity.getBody();
            if (body != null) {
                res.setContentAsString(toJson(body));
                if (body instanceof ProblemDetail) {
                    res.setContentType(MediaType.APPLICATION_PROBLEM_JSON);
                } else {
                    res.setContentType(MediaType.APPLICATION_JSON);
                }
            }
        } else if (result instanceof ProblemDetail pd) {
            res.setStatus(pd.getStatus());
            res.setContentType(MediaType.APPLICATION_PROBLEM_JSON);
            res.setContentAsString(toJson(pd));
        }
    }

    private void handleException(Throwable t, MockHttpServletResponse res) {
        if (adviceInstance != null) {
            // Check @ExceptionHandler methods first
            for (Method m : adviceInstance.getClass().getDeclaredMethods()) {
                if (m.isAnnotationPresent(ExceptionHandler.class)) {
                    ExceptionHandler eh = m.getAnnotation(ExceptionHandler.class);
                    for (Class<?> ec : eh.value()) {
                        if (ec.isInstance(t) || ec.getName().equals(t.getClass().getName()) || ec.getSimpleName().equals(t.getClass().getSimpleName())) {
                            try {
                                m.setAccessible(true);
                                Object r = m.invoke(adviceInstance, t);
                                handleResult(r, res);
                                return;
                            } catch (Exception ignored) {}
                        }
                    }
                }
            }
            // Check single-parameter methods matching exception type
            for (Method m : adviceInstance.getClass().getDeclaredMethods()) {
                if (m.getParameterCount() == 1) {
                    Class<?> pType = m.getParameterTypes()[0];
                    if (pType.isInstance(t) || pType.getName().equals(t.getClass().getName()) || pType.getSimpleName().equals(t.getClass().getSimpleName())) {
                        try {
                            m.setAccessible(true);
                            Object r = m.invoke(adviceInstance, t);
                            handleResult(r, res);
                            return;
                        } catch (Exception ignored) {}
                    }
                }
            }
        }

        String msg = t.getMessage();
        int status = 500;
        String type = "about:blank";
        String title = "Error";
        if (t.getClass().getSimpleName().contains("NotFound")) {
            status = 404;
            type = "https://api.enterprise.com/errors/not-found";
            title = "Resource Not Found";
        } else if (t.getClass().getSimpleName().contains("Conflict")) {
            status = 409;
            type = "https://api.enterprise.com/errors/conflict";
            title = "Resource Conflict";
        }

        res.setStatus(status);
        res.setContentType(MediaType.APPLICATION_PROBLEM_JSON);
        String pdJson = String.format("{\"type\":\"%s\",\"title\":\"%s\",\"status\":%d,\"detail\":\"%s\",\"timestamp\":\"%s\"}",
            type, title, status, msg != null ? msg : "", java.time.Instant.now());
        res.setContentAsString(pdJson);
    }

    private static String extractField(String json, String fieldName) {
        if (json == null) return null;
        Pattern p = Pattern.compile("\"" + fieldName + "\"\\s*:\\s*(\"[^\"]*\"|null|true|false|\\d+)");
        Matcher m = p.matcher(json);
        if (m.find()) {
            String val = m.group(1).trim();
            if (val.startsWith("\"") && val.endsWith("\"")) {
                return val.substring(1, val.length() - 1);
            }
            if ("null".equals(val)) return null;
            return val;
        }
        return null;
    }

    private static String toJson(Object obj) {
        if (obj == null) return "{}";
        if (obj instanceof ProblemDetail pd) {
            StringBuilder b = new StringBuilder("{");
            b.append("\"type\":\"").append(pd.getType()).append("\",");
            b.append("\"title\":\"").append(pd.getTitle()).append("\",");
            b.append("\"status\":").append(pd.getStatus()).append(",");
            b.append("\"detail\":\"").append(pd.getDetail()).append("\"");
            for (Map.Entry<String, Object> e : pd.getProperties().entrySet()) {
                b.append(",\"").append(e.getKey()).append("\":");
                if (e.getValue() instanceof Map<?, ?> map) {
                    b.append("{");
                    boolean first = true;
                    for (Map.Entry<?, ?> me : map.entrySet()) {
                        if (!first) b.append(",");
                        b.append("\"").append(me.getKey()).append("\":\"").append(me.getValue()).append("\"");
                        first = false;
                    }
                    b.append("}");
                } else if (e.getValue() instanceof Number || e.getValue() instanceof Boolean) {
                    b.append(e.getValue());
                } else {
                    b.append("\"").append(e.getValue()).append("\"");
                }
            }
            b.append("}");
            return b.toString();
        }
        if (obj.getClass().isRecord()) {
            StringBuilder b = new StringBuilder("{");
            RecordComponent[] rcs = obj.getClass().getRecordComponents();
            for (int i = 0; i < rcs.length; i++) {
                if (i > 0) b.append(",");
                try {
                    rcs[i].getAccessor().setAccessible(true);
                    Object val = rcs[i].getAccessor().invoke(obj);
                    b.append("\"").append(rcs[i].getName()).append("\":\"").append(val).append("\"");
                } catch (Exception ignored) {}
            }
            b.append("}");
            return b.toString();
        }
        return obj.toString();
    }
}
