"""
coding_seed_data.py
Beginner-friendly coding practice problems, used to auto-seed the
coding_questions table on first startup.

Each test case is checked by actually running the submitted Python code
in a restricted subprocess (see routes/coding_routes.py) - this is a demo
execution sandbox for practice purposes, not a production-grade,
multi-tenant secure code runner.
"""
import json

CODING_SEED_DATA = [
    {
        "title": "Find the Largest Number",
        "slug": "find-largest-number",
        "difficulty": "Easy",
        "category": "Arrays",
        "statement": (
            "Write a function `find_largest(nums)` that takes a list of integers "
            "and returns the largest number in the list."
        ),
        "starter_code": "def find_largest(nums):\n    # write your code here\n    pass\n",
        "test_cases": [
            {"input": "find_largest([3, 7, 2, 9, 4])", "expected": "9"},
            {"input": "find_largest([-5, -1, -9])", "expected": "-1"},
            {"input": "find_largest([10])", "expected": "10"},
        ],
    },
    {
        "title": "Check Even or Odd",
        "slug": "check-even-odd",
        "difficulty": "Easy",
        "category": "Basics",
        "statement": (
            "Write a function `check_even_odd(n)` that returns the string "
            "\"Even\" if n is even, or \"Odd\" if n is odd."
        ),
        "starter_code": "def check_even_odd(n):\n    # write your code here\n    pass\n",
        "test_cases": [
            {"input": "check_even_odd(4)", "expected": "Even"},
            {"input": "check_even_odd(7)", "expected": "Odd"},
            {"input": "check_even_odd(0)", "expected": "Even"},
        ],
    },
    {
        "title": "Reverse a String",
        "slug": "reverse-a-string",
        "difficulty": "Easy",
        "category": "Strings",
        "statement": (
            "Write a function `reverse_string(s)` that returns the reverse of the input string."
        ),
        "starter_code": "def reverse_string(s):\n    # write your code here\n    pass\n",
        "test_cases": [
            {"input": "reverse_string('hello')", "expected": "olleh"},
            {"input": "reverse_string('Python')", "expected": "nohtyP"},
            {"input": "reverse_string('a')", "expected": "a"},
        ],
    },
    {
        "title": "Check Prime Number",
        "slug": "check-prime-number",
        "difficulty": "Medium",
        "category": "Math",
        "statement": (
            "Write a function `is_prime(n)` that returns True if n is a prime number, "
            "and False otherwise. Assume n is a positive integer."
        ),
        "starter_code": "def is_prime(n):\n    # write your code here\n    pass\n",
        "test_cases": [
            {"input": "is_prime(7)", "expected": "True"},
            {"input": "is_prime(10)", "expected": "False"},
            {"input": "is_prime(2)", "expected": "True"},
            {"input": "is_prime(1)", "expected": "False"},
        ],
    },
    {
        "title": "Sum of an Array",
        "slug": "sum-of-an-array",
        "difficulty": "Easy",
        "category": "Arrays",
        "statement": (
            "Write a function `array_sum(nums)` that returns the sum of all numbers in the list."
        ),
        "starter_code": "def array_sum(nums):\n    # write your code here\n    pass\n",
        "test_cases": [
            {"input": "array_sum([1, 2, 3, 4])", "expected": "10"},
            {"input": "array_sum([])", "expected": "0"},
            {"input": "array_sum([-2, 2])", "expected": "0"},
        ],
    },
    {
        "title": "Check Palindrome",
        "slug": "check-palindrome",
        "difficulty": "Medium",
        "category": "Strings",
        "statement": (
            "Write a function `is_palindrome(s)` that returns True if the string reads "
            "the same forwards and backwards, and False otherwise."
        ),
        "starter_code": "def is_palindrome(s):\n    # write your code here\n    pass\n",
        "test_cases": [
            {"input": "is_palindrome('madam')", "expected": "True"},
            {"input": "is_palindrome('hello')", "expected": "False"},
            {"input": "is_palindrome('level')", "expected": "True"},
        ],
    },
]

for problem in CODING_SEED_DATA:
    problem["test_cases_json"] = json.dumps(problem.pop("test_cases"))
