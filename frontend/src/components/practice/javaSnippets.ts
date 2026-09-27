import { snippetCompletion, completeFromList, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { Extension } from '@codemirror/state';
import { autocompletion } from '@codemirror/autocomplete';

/**
 * javaSnippets.ts
 * Curated SOTA 2026 JUnit 5 & AssertJ Snippet Templates for CodeMirror 6.
 * Single responsibility: code completion snippets for testing katas and LLD challenges.
 * Cognitive bounding limit: <= 350 lines.
 */

export const JUNIT_ASSERTJ_SNIPPETS = [
  snippetCompletion(
    '@Test\nvoid test${1:Behavior}() {\n    // Arrange\n    ${2:// setup parameters and mocks}\n\n    // Act\n    ${3:// invoke tested method}\n\n    // Assert\n    assertThat(${4:result}).isNotNull();\n}',
    {
      label: 'test:aaa',
      detail: 'JUnit 5: AAA Pattern (@Test)',
      type: 'keyword',
      boost: 99
    }
  ),
  snippetCompletion(
    '@ParameterizedTest\n@ValueSource(${1:strings = {"${2:value1}", "${3:value2}"}})\nvoid test${4:Boundary}(${5:String input}) {\n    // Act & Assert\n    assertThat(${6:service.validate(input)}).isTrue();\n}',
    {
      label: 'test:param:value',
      detail: 'JUnit 5: @ParameterizedTest + @ValueSource',
      type: 'keyword',
      boost: 95
    }
  ),
  snippetCompletion(
    '@ParameterizedTest(name = "[{index}] input={0} -> expected={1}")\n@CsvSource({\n    "${1:10}, ${2:true}",\n    "${3:0}, ${4:false}",\n    "${5:-1}, ${6:false}"\n})\nvoid test${7:BoundaryCases}(${8:int input}, ${9:boolean expected}) {\n    // Act & Assert\n    assertThat(${10:service.process(input)}).isEqualTo(expected);\n}',
    {
      label: 'test:param:csv',
      detail: 'JUnit 5: @ParameterizedTest + @CsvSource boundary matrix',
      type: 'keyword',
      boost: 96
    }
  ),
  snippetCompletion(
    'assertThatThrownBy(() -> ${1:service.execute(${2:input})})\n    .isInstanceOf(${3:IllegalArgumentException}.class)\n    .hasMessageContaining("${4:error message}");',
    {
      label: 'assert:thrownBy',
      detail: 'AssertJ: assertThatThrownBy exception assertion',
      type: 'function',
      boost: 90
    }
  ),
  snippetCompletion(
    'var captor = ArgumentCaptor.forClass(${1:Payload}.class);\nverify(${2:mockRepository}, times(1)).${3:save}(captor.capture());\nassertThat(captor.getValue().${4:getId()}).isEqualTo(${5:expectedId});',
    {
      label: 'mockito:captor',
      detail: 'Mockito: ArgumentCaptor inspection for void methods',
      type: 'function',
      boost: 88
    }
  ),
  snippetCompletion(
    'verify(${1:mockRepository}, times(1)).${2:save}(any());\nverifyNoMoreInteractions(${1:mockRepository});',
    {
      label: 'mockito:verify',
      detail: 'Mockito: verify void method calls and no more interactions',
      type: 'function',
      boost: 85
    }
  ),
  snippetCompletion(
    'Clock clock = Clock.fixed(Instant.parse("${1:2026-09-24T12:00:00Z}"), ZoneId.of("UTC"));',
    {
      label: 'clock:fixed',
      detail: 'Java 21: Deterministic Virtual Time (Clock.fixed)',
      type: 'variable',
      boost: 92
    }
  )
];

/**
 * Autocompletion source triggered by '@' or 'assert' or 'test' or typed letters
 */
function javaTestCompletionSource(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[\w@:]*/);
  if (!word || (word.from === word.to && !context.explicit)) {
    return null;
  }

  return {
    from: word.from,
    options: JUNIT_ASSERTJ_SNIPPETS
  };
}

export function createJavaSnippetsExtension(): Extension {
  return autocompletion({
    override: [javaTestCompletionSource]
  });
}
