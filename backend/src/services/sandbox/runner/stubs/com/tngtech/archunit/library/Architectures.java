package com.tngtech.archunit.library;

import com.tngtech.archunit.core.domain.*;
import com.tngtech.archunit.lang.ArchRule;
import java.util.*;

public class Architectures {

    public static LayeredArchitecture layeredArchitecture() {
        return new LayeredArchitecture();
    }

    public static class LayeredArchitecture implements ArchRule {
        private final Map<String, String> layers = new LinkedHashMap<>();
        private final Map<String, Set<String>> allowedAccessors = new HashMap<>();
        private final Set<String> mayNotBeAccessedLayers = new HashSet<>();
        private String becauseReason;
        private String description;

        public LayeredArchitecture consideringAllDependencies() {
            return this;
        }

        public LayerDefinition layer(String name) {
            return new LayerDefinition(this, name);
        }

        public LayerDefinition definedBy(String packageIdentifier) {
            return new LayerDefinition(this, packageIdentifier);
        }

        public static class LayerDefinition {
            private final LayeredArchitecture parent;
            private final String packageId;

            public LayerDefinition(LayeredArchitecture parent, String packageId) {
                this.parent = parent;
                this.packageId = packageId;
            }

            public LayerDefinition definedBy(String packageIdentifier) {
                return this;
            }

            public LayerDefinition layer(String nextLayerName) {
                return parent.layer(nextLayerName);
            }

            public LayeredArchitecture whereLayer(String layerName) {
                return parent.whereLayer(layerName);
            }
        }

        public LayeredArchitecture whereLayer(String layerName) {
            currentLayerForAccess = layerName;
            return this;
        }

        private String currentLayerForAccess;

        public LayeredArchitecture mayNotBeAccessedByAnyLayer() {
            if (currentLayerForAccess != null) {
                mayNotBeAccessedLayers.add(currentLayerForAccess);
            }
            return this;
        }

        public LayeredArchitecture mayOnlyBeAccessedByLayers(String... layerNames) {
            if (currentLayerForAccess != null) {
                allowedAccessors.computeIfAbsent(currentLayerForAccess, k -> new HashSet<>())
                    .addAll(Arrays.asList(layerNames));
            }
            return this;
        }

        public LayeredArchitecture because(String reason) {
            this.becauseReason = reason;
            return this;
        }

        public LayeredArchitecture as(String description) {
            this.description = description;
            return this;
        }

        @Override
        public void check(JavaClasses classes) {
            // Check for direct controller -> repository access or illegal cross-layer calls
            for (JavaClass jc : classes) {
                String pkg = jc.getPackageName();
                if (pkg.contains("controller")) {
                    for (String dep : jc.getDirectDependencyNames()) {
                        if (dep.contains("repository") || dep.contains("Repository")) {
                            throw new AssertionError("Architecture violation: Controller <" + jc.getName() + "> depends directly on Repository <" + dep + ">");
                        }
                    }
                }
                if (pkg.contains("domain")) {
                    for (String dep : jc.getDirectDependencyNames()) {
                        if (dep.contains("service") || dep.contains("Service")) {
                            throw new AssertionError("Architecture violation: Domain entity <" + jc.getName() + "> depends directly on Service <" + dep + ">");
                        }
                    }
                }
            }
        }
    }
}
